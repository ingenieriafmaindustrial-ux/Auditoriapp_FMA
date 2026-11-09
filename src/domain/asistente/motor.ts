// Motor del asistente de auditoría: desmenuza la frase y cruza biblioteca FMA + normas + historial + aprendizaje.
// 100 % local (sin IA ni red). Aprende de los hallazgos que guardan todos los auditores (colección 'aprendizaje').
import { HALLAZGOS_TIPO, type HallazgoTipo } from '../../data/hallazgosTipo';
import { HISTORIAL_FMA } from '../../data/historialFMA';
import { EQUIVALENCIAS, SENALES_INCUMPLIMIENTO, SENALES_MEJORA, SENALES_REINCIDENCIA, TERMINOS_CLAUSULA } from '../../data/indiceNormas';
import { REQUISITOS_SEED } from '../../data/requisitosSeed';
import type { Norma } from '../../types';
import { expandir, normalizar, palabras, raiz, raices, raicesTermino } from './texto';

export type Confianza = 'alta' | 'media' | 'baja';

/** Registro de aprendizaje (Firestore). Solo raíces y cláusulas: nunca el texto del hallazgo. */
export interface DocAprendido {
  id: string;
  terminos: string[];
  clausulas: string[];
  rechazadas?: string[];
  tipo: 'NC' | 'OM';
  area: string;
  sucursal: string;
  anio: number;
  auditoriaId?: string;
  anulado?: boolean;
}

export interface ContextoAnalisis {
  normas: Norma[];
  area?: string;
  sucursal?: string;
  anio?: number;
  auditoriaId?: string;
  /** Id del hallazgo en edición: no se compara consigo mismo. */
  excluirId?: string;
}

export interface ClausulaSugerida {
  clave: string;
  norma: Norma;
  clausula: string;
  titulo: string;
  puntaje: number;
  confianza: Confianza;
  motivos: string[];
  equivalente: boolean;
  /** Términos de la norma que coincidieron con el texto del hallazgo. */
  terminos: string[];
  /** Tipo de hallazgo FMA (biblioteca) que lo respalda. */
  tipoFMA: string | null;
  /** N° de hallazgos anteriores parecidos que usaron esta cláusula. */
  previos: number;
}

export interface Similar {
  origen: 'historial' | 'aprendido';
  id: string;
  anio: number;
  area: string;
  sucursal: string;
  tipo: 'NC' | 'OM';
  similitud: number;
  extracto: string | null;
  clausulas: string[];
  mismaArea: boolean;
}

export interface Analisis {
  palabrasClave: string[];
  clasificacion: { tipo: 'NC' | 'OM'; confianza: Confianza; motivos: string[] } | null;
  clausulas: ClausulaSugerida[];
  similares: Similar[];
  reincidencias: Similar[];
  tipos: { tipo: HallazgoTipo; confianza: number }[];
  vacio: boolean;
}

const TITULOS = new Map(REQUISITOS_SEED.map((r) => [`${r.norma}|${r.clausula}`, r.titulo]));
const EQUIV = new Map<string, string[]>();
EQUIVALENCIAS.forEach((g) => g.forEach((k) => EQUIV.set(k, g.filter((x) => x !== k))));

const nivel = (p: number): Confianza => (p >= 0.55 ? 'alta' : p >= 0.3 ? 'media' : 'baja');
const baseArea = (s: string) => normalizar(s).trim().split(' ')[0] ?? '';

interface DocVector {
  origen: Similar['origen'];
  id: string;
  anio: number;
  area: string;
  sucursal: string;
  tipo: 'NC' | 'OM';
  clausulas: string[];
  rechazadas: string[];
  extracto: string | null;
  auditoriaId?: string;
  tf: Map<string, number>;
}

function contar(rs: string[]) {
  const m = new Map<string, number>();
  rs.forEach((r) => m.set(r, (m.get(r) ?? 0) + 1));
  return m;
}

export interface Motor {
  analizar: (texto: string, ctx: ContextoAnalisis) => Analisis;
  memoria: { historial: number; aprendidos: number };
}

export function crearMotor(aprendidos: DocAprendido[]): Motor {
  // ── Memoria: historial + aprendido ──
  const docs: DocVector[] = [
    ...HISTORIAL_FMA.map((h, i) => ({
      origen: 'historial' as const, id: `h${i}`, anio: h.anio, area: h.area, sucursal: h.sucursal, tipo: h.tipo,
      clausulas: h.clausulas, rechazadas: [], extracto: h.extracto, tf: contar(raices(h.texto)),
    })),
    ...aprendidos
      .filter((a) => !a.anulado && a.terminos?.length)
      .map((a) => ({
        origen: 'aprendido' as const, id: a.id, anio: a.anio, area: a.area, sucursal: a.sucursal, tipo: a.tipo,
        clausulas: a.clausulas ?? [], rechazadas: a.rechazadas ?? [], extracto: null, auditoriaId: a.auditoriaId, tf: contar(a.terminos),
      })),
  ];

  // IDF sobre toda la memoria: palabras genéricas pesan poco, las específicas mucho
  const df = new Map<string, number>();
  docs.forEach((d) => d.tf.forEach((_, r) => df.set(r, (df.get(r) ?? 0) + 1)));
  const N = docs.length || 1;
  const idf = (r: string) => Math.log(1 + N / (1 + (df.get(r) ?? 0)));
  const normas = docs.map((d) => Math.sqrt([...d.tf].reduce((s, [r, n]) => s + (n * idf(r)) ** 2, 0)) || 1);

  // ── Índice de normas: términos + título del catálogo ──
  // Solo cláusulas con número (4.1, 8.2.1…): los capítulos sueltos ("7 Apoyo") son demasiado genéricos
  const indice = [...new Set([...Object.keys(TERMINOS_CLAUSULA), ...TITULOS.keys()])].filter((k) => k.includes('.')).map((clave) => ({
    clave,
    terminos: (TERMINOS_CLAUSULA[clave] ?? []).map((t) => ({ t, rs: raicesTermino(t) })),
    titulo: raicesTermino(TITULOS.get(clave) ?? ''),
  }));

  // ── Biblioteca FMA ──
  const biblioteca = HALLAZGOS_TIPO.map((t) => ({
    tipo: t,
    claves: t.claves.map(raicesTermino),
    contexto: t.contexto.map(raicesTermino),
  }));

  function analizar(texto: string, ctx: ContextoAnalisis): Analisis {
    const n = expandir(normalizar(texto));
    const rs = raices(n, true);
    const set = new Set(rs);
    const vacio = set.size < 2;
    const original = new Map<string, string>();
    palabras(normalizar(texto)).forEach((w) => { const r = raiz(w); if (set.has(r) && !original.has(r)) original.set(r, w); });
    const usadas = new Set<string>();
    const pos = new Map<string, number[]>();
    rs.forEach((r, i) => pos.set(r, [...(pos.get(r) ?? []), i]));
    /** Todas las raíces del término presentes y cercanas entre sí (ventana de largo + 3 palabras). */
    const tiene = (t: string[]) => {
      if (!t.length || !t.every((r) => set.has(r))) return false;
      if (t.length === 1) return true;
      // Dos palabras: en orden y cercanas ("zona de seguridad" ≠ "seguridad en zona")
      if (t.length === 2) return pos.get(t[0])!.some((a) => pos.get(t[1])!.some((b) => b > a && b - a <= 4));
      const pares = t.flatMap((r) => pos.get(r)!.map((p) => [p, r] as const)).sort((a, b) => a[0] - b[0]);
      const cuenta = new Map<string, number>();
      let ini = 0;
      for (let fin = 0; fin < pares.length; fin++) {
        cuenta.set(pares[fin][1], (cuenta.get(pares[fin][1]) ?? 0) + 1);
        while (cuenta.size === t.length) {
          if (pares[fin][0] - pares[ini][0] <= t.length + 3) return true;
          const r0 = pares[ini][1];
          const c0 = cuenta.get(r0)! - 1;
          if (c0) cuenta.set(r0, c0); else cuenta.delete(r0);
          ini++;
        }
      }
      return false;
    };
    const peso = (t: string[]) => t.reduce((s, r) => s + idf(r), 0);

    if (vacio) return { palabrasClave: [], clasificacion: null, clausulas: [], similares: [], reincidencias: [], tipos: [], vacio };

    // 1) Biblioteca
    const tipos = biblioteca
      .map(({ tipo, claves, contexto }) => {
        const hk = claves.filter(tiene);
        if (!hk.length) return null;
        const hc = contexto.filter(tiene);
        hk.concat(hc).flat().forEach((r) => usadas.add(r));
        return { tipo, confianza: Math.min(1, (hk.length * 3 + hc.length) / 4.5) };
      })
      .filter((x): x is { tipo: HallazgoTipo; confianza: number } => !!x)
      .sort((a, b) => b.confianza - a.confianza || b.tipo.veces - a.tipo.veces)
      .slice(0, 3);

    // 2) Normas
    const puntNorma = new Map<string, { p: number; motivo: string; terminos: string[] }>();
    for (const { clave, terminos, titulo } of indice) {
      const hits = terminos.filter((x) => tiene(x.rs)).map((x) => ({ w: peso(x.rs) * (x.rs.length > 1 ? 1.25 : 1), t: x.t, rs: x.rs }));
      const enTitulo = titulo.filter((r) => set.has(r));
      if (titulo.length && enTitulo.length >= Math.min(2, titulo.length) && tiene(enTitulo)) hits.push({ w: peso(enTitulo) * 1.1, t: TITULOS.get(clave) ?? '', rs: enTitulo });
      if (!hits.length) continue;
      hits.sort((a, b) => b.w - a.w);
      hits.forEach((h) => h.rs.forEach((r) => usadas.add(r)));
      const raw = hits[0].w + (hits[1]?.w ?? 0) * 0.35;
      puntNorma.set(clave, { p: Math.min(1, raw / 7), motivo: `Norma: «${hits[0].t}»`, terminos: [...new Set(hits.slice(0, 3).map((h) => h.t))] });
    }

    // 3) Historial + aprendizaje (similitud TF-IDF coseno)
    const q = contar(rs);
    const qNorm = Math.sqrt([...q].reduce((s, [r, c]) => s + (c * idf(r)) ** 2, 0)) || 1;
    const areaCtx = ctx.area ? baseArea(ctx.area) : '';
    const similaresTodos: Similar[] = [];
    const vecDocs: { d: DocVector; sim: number }[] = [];
    docs.forEach((d, i) => {
      if (d.id === ctx.excluirId) return;
      let dot = 0;
      q.forEach((c, r) => { const t = d.tf.get(r); if (t) dot += c * t * idf(r) ** 2; });
      if (!dot) return;
      const mismaArea = !!areaCtx && baseArea(d.area) === areaCtx && (!ctx.sucursal || d.sucursal === ctx.sucursal);
      const sim = Math.min(1, (dot / (qNorm * normas[i])) * (mismaArea ? 1.2 : 1) * (d.origen === 'aprendido' ? 1.1 : 1));
      if (sim < 0.12) return;
      vecDocs.push({ d, sim });
      similaresTodos.push({ origen: d.origen, id: d.id, anio: d.anio, area: d.area, sucursal: d.sucursal, tipo: d.tipo, similitud: sim, extracto: d.extracto, clausulas: d.clausulas, mismaArea });
    });
    vecDocs.sort((a, b) => b.sim - a.sim);
    const top = vecDocs.slice(0, 8);
    const votos = new Map<string, number>();
    const conCl = top.filter((x) => x.d.clausulas.length);
    const totalSim = conCl.reduce((s, x) => s + x.sim, 0) || 1;
    const maxSim = top[0]?.sim ?? 0;
    conCl.forEach(({ d, sim }) => d.clausulas.forEach((c) => votos.set(c, (votos.get(c) ?? 0) + sim)));
    top.forEach(({ d, sim }) => d.rechazadas.forEach((c) => votos.set(c, (votos.get(c) ?? 0) - sim * 0.6)));
    const puntHist = new Map<string, { p: number; n: number }>();
    votos.forEach((v, c) => {
      if (v <= 0) return;
      puntHist.set(c, { p: Math.min(1, (v / totalSim) * Math.min(1, maxSim / 0.3)), n: conCl.filter((x) => x.d.clausulas.includes(c)).length });
    });

    // Reincidencia en la misma área (hallazgo parecido de un año o auditoría anterior)
    const reincidencias = similaresTodos
      .filter((s) => s.mismaArea && s.similitud >= 0.3 && (s.origen === 'historial' ? !ctx.anio || s.anio < ctx.anio : s.id !== ctx.excluirId && (!ctx.auditoriaId || aprendidos.find((a) => a.id === s.id)?.auditoriaId !== ctx.auditoriaId)))
      .sort((a, b) => b.similitud - a.similitud)
      .slice(0, 3);

    // 4) Fusión de fuentes
    const claves = new Set<string>([...puntNorma.keys(), ...puntHist.keys()]);
    const puntBib = new Map<string, { p: number; motivo: string }>();
    tipos.forEach(({ tipo, confianza }) =>
      tipo.requisitos.forEach((r, i) => {
        const k = `${r.norma}|${r.clausula}`;
        const p = confianza * (1 - i * 0.08);
        if ((puntBib.get(k)?.p ?? 0) < p) puntBib.set(k, { p, motivo: `Biblioteca FMA: ${tipo.titulo}` });
        claves.add(k);
      }),
    );

    const fusion = new Map<string, ClausulaSugerida>();
    const extra = (k: string) => ({ terminos: puntNorma.get(k)?.terminos ?? [], tipoFMA: puntBib.get(k)?.motivo.replace('Biblioteca FMA: ', '') ?? null, previos: puntHist.get(k)?.n ?? 0 });
    const agregar = (clave: string, puntaje: number, motivos: string[], equivalente: boolean, de = clave) => {
      const [norma, clausula] = clave.split('|') as [Norma, string];
      if (ctx.normas.length && !ctx.normas.includes(norma)) return;
      if (!TITULOS.has(clave) || !clausula.includes('.')) return;
      const prev = fusion.get(clave);
      if (prev && prev.puntaje >= puntaje) return;
      fusion.set(clave, { clave, norma, clausula, titulo: TITULOS.get(clave) ?? '', puntaje, confianza: nivel(puntaje), motivos, equivalente, ...extra(de) });
    };
    claves.forEach((k) => {
      const b = puntBib.get(k), no = puntNorma.get(k), h = puntHist.get(k);
      const fuentes = [b, no, h].filter(Boolean).length;
      // Consenso: 2+ hallazgos parecidos (del historial o aprendidos del equipo) usaron la misma cláusula
      const consenso = !!h && h.n >= 2 && h.p >= 0.35;
      const p = 0.38 * (b?.p ?? 0) + 0.3 * (no?.p ?? 0) + 0.32 * (h?.p ?? 0) + (fuentes >= 2 ? 0.12 : 0) + (fuentes === 3 ? 0.08 : 0) + (consenso ? 0.14 : 0);
      if (p < 0.14) return;
      const motivos = [b?.motivo, no?.motivo, h ? `${h.n} hallazgo(s) anterior(es) parecido(s) la usaron` : undefined].filter((x): x is string => !!x);
      agregar(k, Math.min(1, p), motivos, false);
      if (p >= 0.35) (EQUIV.get(k) ?? []).forEach((e) => agregar(e, Math.min(1, p) * 0.72, [`Equivalente de ${k.replace('|', ' ')}`, ...motivos.slice(0, 1)], true, k));
    });
    // Reincidencia: las cláusulas del hallazgo anterior y la 10.2 (acción correctiva no eficaz) se proponen siempre
    const reforzar = (clave: string, puntaje: number, motivo: string) => {
      const prev = fusion.get(clave);
      agregar(clave, Math.max(puntaje, prev?.puntaje ?? 0), [motivo, ...(prev?.motivos ?? [])], prev?.equivalente ?? false);
      const x = fusion.get(clave);
      if (x && prev && x.puntaje === prev.puntaje) x.motivos = [motivo, ...prev.motivos.filter((m) => m !== motivo)];
    };
    reincidencias.forEach((r) =>
      r.clausulas.forEach((k) => reforzar(k, Math.min(0.9, 0.45 + 0.4 * r.similitud), `Reincidencia: la misma cláusula se usó en ${r.anio} (${r.tipo === 'NC' ? 'No conformidad' : 'Oportunidad de mejora'}) en esta área`)),
    );
    if (reincidencias.length) {
      // 10.2 solo en la(s) norma(s) del hallazgo anterior; si no tenía cláusulas, ISO 9001 (o la primera norma de la auditoría)
      const deAntes = [...new Set(reincidencias.flatMap((r) => r.clausulas.map((k) => k.split('|')[0] as Norma)))].filter((n) => !ctx.normas.length || ctx.normas.includes(n));
      const normas10 = deAntes.length ? deAntes : [ctx.normas.includes('ISO 9001') || !ctx.normas.length ? ('ISO 9001' as Norma) : ctx.normas[0]];
      normas10.forEach((n) => reforzar(`${n}|10.2`, 0.5, 'Reincidencia: evaluar si la acción correctiva anterior fue eficaz (10.2)'));
    }
    const ordenadas = [...fusion.values()].sort((a, b) => b.puntaje - a.puntaje);
    const fuertes = ordenadas.filter((c) => c.confianza !== 'baja');
    const clausulas = (fuertes.length >= 3 ? fuertes : [...fuertes, ...ordenadas.filter((c) => c.confianza === 'baja').slice(0, 3 - fuertes.length)]).slice(0, 7);

    // 5) Clasificación NC / OM
    let nc = 0, om = 0;
    const mot: string[] = [];
    const inc = SENALES_INCUMPLIMIENTO.filter((s) => n.includes(` ${s} `)).slice(0, 3);
    const mej = SENALES_MEJORA.filter((s) => n.includes(` ${s} `)).slice(0, 2);
    const rei = SENALES_REINCIDENCIA.filter((s) => n.includes(` ${s} `)).slice(0, 2);
    if (inc.length) { nc += Math.min(2, inc.length) * 0.6; mot.push(`Señal de incumplimiento: «${inc.join('», «')}»`); }
    if (mej.length) { om += Math.min(2, mej.length) * (inc.length ? 0.8 : 1.4); mot.push(`Redacción de mejora: «${mej.join('», «')}»`); }
    if (rei.length) { nc += 0.5; mot.push(`Menciona reiteración: «${rei.join('», «')}»`); }
    // Un tema que se repite en el área indica que la acción anterior no fue eficaz → pesa fuerte hacia NC
    if (reincidencias.length) { nc += 1.2 + reincidencias[0].similitud * 1.5; mot.unshift(`Reincidencia en el área (${reincidencias.map((r) => r.anio).join(', ')}): si se repite, corresponde NC`); }
    tipos.slice(0, 1).forEach(({ tipo, confianza }) => {
      if (tipo.tipo === 'NC') nc += confianza * 0.8;
      if (tipo.tipo === 'OM') om += confianza * 0.8;
      if (tipo.tipo !== 'NC/OM') mot.push(`En FMA suele ser ${tipo.tipo}: ${tipo.titulo}`);
    });
    const simTop = top.slice(0, 5);
    const simNC = simTop.filter((x) => x.d.tipo === 'NC').reduce((s, x) => s + x.sim, 0);
    const simOM = simTop.filter((x) => x.d.tipo === 'OM').reduce((s, x) => s + x.sim, 0);
    nc += simNC * 1.5; om += simOM * 1.5;
    if (simTop.length) mot.push(`Hallazgos parecidos: ${simTop.filter((x) => x.d.tipo === 'NC').length} NC y ${simTop.filter((x) => x.d.tipo === 'OM').length} OM`);
    let clasificacion: Analisis['clasificacion'] = null;
    if (nc + om >= 0.5) {
      const tipo = nc >= om ? 'NC' : 'OM';
      const margen = Math.abs(nc - om) / (nc + om);
      if (tipo === 'NC' && !clausulas.some((c) => c.confianza !== 'baja')) mot.push('Para NC, confirma el requisito incumplido');
      clasificacion = { tipo, confianza: margen >= 0.5 ? 'alta' : margen >= 0.22 ? 'media' : 'baja', motivos: mot };
    }


    const similares = similaresTodos.filter((x) => x.similitud >= 0.2).sort((a, b) => b.similitud - a.similitud).slice(0, 4);
    const palabrasClave = [...usadas].map((r) => original.get(r)).filter((w): w is string => !!w).slice(0, 10);
    return { palabrasClave, clasificacion, clausulas, similares, reincidencias, tipos, vacio };
  }

  return { analizar, memoria: { historial: HISTORIAL_FMA.length, aprendidos: aprendidos.filter((a) => !a.anulado).length } };
}
